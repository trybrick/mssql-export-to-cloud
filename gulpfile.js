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


var config = require('./config.js')
var etype = util.env.etype || 'product';
var today = moment(new Date());

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
  _.each(items, function(obj, k) {
    writeFile(obj, typeConfig.output);
  })
  cb();
}

var batchRequestStream = createBatchRequestStream({
  request: batchWrite,
  batchSize: 10000,
  maxLiveRequests: 1,
  streamOptions: {
    objectMode: true
  }
})

gulp.task('export', function(cb) {
  var conn = null;
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
      stream.end();
      request.connection.close();
      cb();
    });
  }).catch(errorHandler);
});

gulp.task('upload', function() {
  return gulp.src(typeConfig.output)
    .pipe(gzip())
    .pipe(s3({
      Bucket: 'brick-workspace',
      manualContentEncoding: 'gzip',
      keyTransform: function(relative_filename) {
        // add yy mm dd to filename
        var new_name = 'exports/' + today.format("YYYYMMDD") + '/' + relative_filename;
        console.log(new_name);
        // or do whatever you want 
        return new_name;
      }
    }));
});

gulp.task('default', function(cb) {
  runSequence('export', 'upload', cb);
});
