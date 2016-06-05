var gulp = require('gulp');
var gzip = require('gulp-gzip');
var sql = require('mssql');
var fs = require('fs');
var util = require('gulp-util');
var moment = require('moment');
var runSequence = require('run-sequence');
var createBatchRequestStream = require('batch-request-stream');
var mkdirp = require('mkdirp');
var _ = require('lodash');
var path = require('path');
var del = require('del');
var glob = require("multi-glob").glob;
var async = require('async');
var zlib = require('zlib');

var outPath = './exports/';
var config = require('./config.js')
var etype = util.env.etype || 'product';
var today = moment(new Date());
var uploadTasks = [];

var typeConfig = config.etypes[etype];
console.log(typeConfig);

var s3 = require('gulp-s3-upload')(typeConfig.aws);

function exists(filePath, isFolder) {
  try {
    var stat = fs.statSync(filePath);
    return isFolder ? stat.isDirectory() : stat.isFile();
  } catch (err) {
    return false;
  }
}

function compressFile(inputFile, cb) {
  var gzip = zlib.createGzip();
  var fs = require('fs');
  var inp = fs.createReadStream(inputFile);
  var out = fs.createWriteStream(inputFile + '.gz');

  inp.pipe(gzip).pipe(out);
  inp.on('error', function(err) {
    cb(err);
  });
  inp.on('close', cb);
}

function processFile(inputFile, cb) {
  var taskName = 'upload' + uploadTasks.length;
  uploadTasks.push(taskName);
  gulp.task(taskName, function() {
    return gulp.src(inputFile + '.gz', {
      buffer: false
    })
      .pipe(s3({
        Bucket: 'brick-workspace',
        manualContentEncoding: 'gzip',
        keyTransform: function(relative_filename) {
          // add yy mm dd to filename
          var new_name = 'exports/' + etype + '/' + relative_filename;
          console.log(new_name);
          // or do whatever you want 
          return new_name;
        }
      }));
  });
  compressFile(inputFile, cb);
}

if (!exists(outPath, true)) {
  mkdirp.sync(outPath);
}

function writeFile(obj, outFile) {
  outFile = path.resolve(outFile);
  var data = JSON.stringify(obj) + '\n';

  var basePath = path.dirname(outFile);
  if (!exists(basePath, true)) {
    mkdirp.sync(basePath);
  }

  if (!exists(outFile)) {
    fs.writeFileSync(
      outFile, data
    );

    return;
  }

  fs.appendFileSync(
    outFile, data
  );
}

function batchWrite(items, cb) {
  var i = 0;
  _.each(items, function(obj, k) {
    var filePosfix = i % 10;
    writeFile(obj, outPath + typeConfig.output + filePosfix);
    i++;
  })
  cb();
}

var batchRequestStream = createBatchRequestStream({
  request: batchWrite,
  batchSize: 100,
  maxLiveRequests: 100,
  streamOptions: {
    objectMode: true
  }
})

gulp.task('export', function(cb) {
  var conn = null;

  if (exists(typeConfig.output)) {
    fs.unlinkSync(typeConfig.output);
  }

  var errorHandler = function errorHandler(err) {
    if (err) {
      console.log(err);

      cb(err);
      return;
    }
  };
  var Db = sql.connect(config.mssql);
  var query = typeConfig.query;
  var i = 0;
  Db.then(function() {
    var request = new sql.Request();
    request.stream = true;
    request.query(query);
    request.on('recordset', function(columns) {
      // Emitted once for each recordset in a query 
    });

    request.on('row', function(row) {
      // Emitted for each row in a recordset 
      if (typeConfig.rowHandler) {
        typeConfig.rowHandler(row);
      }
      row.etype = etype;
      row.idx = etype + '-' + today.format("YYYY.MM.DD");
      row.Id = row[typeConfig.idColumn];
      i++;
      if (i % 10000 == 0) {
        console.log(i, row.Id);
      }
      batchRequestStream.write(row);
    });

    request.on('error', errorHandler);

    request.on('done', function(affected) {
      // Always emitted as the last one 
      request.connection.close();
      cb();
    });
  }).catch(errorHandler);
});

gulp.task('clean', function() {
  return del([outPath + '**/*']);
});

gulp.task('clean-gz', function() {
  return del([outPath + '*.gz']);
});

gulp.task('compress', function(cb) {
  glob(outPath + '**/*', function(er, files) {
    if (er) {
      cb(er)
    }

    async.eachSeries(files, processFile, cb);
  });
});

gulp.task('upload', function(cb) {
  /*return gulp.src(outPath + '*.gz', {
    buffer: false
  })
    .pipe(s3({
      Bucket: 'brick-workspace',
      manualContentEncoding: 'gzip',
      keyTransform: function(relative_filename) {
        // add yy mm dd to filename
        var new_name = 'exports/' + etype + '/' + relative_filename;
        console.log(new_name);
        // or do whatever you want 
        return new_name;
      }
    }));*/
  uploadTasks.push(cb);
  runSequence.apply(null, uploadTasks);
});

gulp.task('default', function(cb) {
  runSequence('clean', 'export', 'compress', 'upload', cb);
});

gulp.task('restart', function(cb) {
  runSequence('clean-gz', 'compress', 'upload', cb);
});
