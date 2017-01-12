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

/**
 * Check for file/folder exists.
 * @param  {[type]}  filePath path to file or folder
 * @param  {Boolean} isFolder true if folder
 * @return {[type]}           true if exists
 */
function exists(filePath, isFolder) {
  try {
    var stat = fs.statSync(filePath);
    return isFolder ? stat.isDirectory() : stat.isFile();
  } catch (err) {
    return false;
  }
}

/**
 * Compress a file.
 * @param  {[type]}   inputFile file path to compress
 * @param  {Function} cb        callback on complete
 */
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

/**
 * Upload a file to s3
 * @param  {[type]}   inputFile [description]
 * @param  {Function} cb        [description]
 * @return {[type]}             [description]
 */
function processFile(inputFile, cb) {
  var taskName = 'upload' + uploadTasks.length;
  uploadTasks.push(taskName);
  gulp.task(taskName, function() {
    var search = inputFile;
    if (typeConfig.compressFile) {
      search += '.gz';
    }

    return gulp.src(search, {
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

  if (!typeConfig.compressFile) {
    cb();
    return;
  }

  compressFile(inputFile, cb);
}

// auto create outPath if not exists
if (!exists(outPath, true)) {
  mkdirp.sync(outPath);
}

/**
 * Output array to csv.
 * @param  {[type]} arr       output array of items
 * @param  {[type]} delimiter column separator
 * @return {[type]}           CSV data
 */
function arrayToCsv(arr, delimiter) {
  return _.map(arr, function(value) {
    if (typeof value === "string") {

      // handle numeric and empty string
      if (/^\d+$/gi.test(value)) {
        return value;
      } else if (!value) {
        return value;
      }

      // escape a string with stringify
      value = JSON.stringify(value);
    }
    return value;
  }).join(delimiter || ',');
}

/**
 * Write object to file.  Handle append if file exists.
 * @param  {[type]} obj     data object
 * @param  {[type]} outFile output file
 * @return {[type]}
 */
function writeFile(obj, outFile) {
  outFile = path.resolve(outFile);
  var rowDelimiter = typeConfig.rowDelimiter || '\n';
  var data = JSON.stringify(obj) + rowDelimiter;

  var basePath = path.dirname(outFile);
  if (!exists(basePath, true)) {
    mkdirp.sync(basePath);
  }

  if (typeConfig.headers) {
    var outData = [];
    _.each(typeConfig.headers, function(v) {
      outData.push(obj[v]);
    });
    data = arrayToCsv(outData, typeConfig.delimiter) + rowDelimiter;
  }

  if (!exists(outFile)) {
    if (typeConfig.headers) {
      fs.writeFileSync(outFile, arrayToCsv(typeConfig.headers, typeConfig.delimiter) + rowDelimiter);
    }
    else {
      fs.writeFileSync(
        outFile, data
      );
      return;
    }

  }

  try {
    fs.appendFileSync(
      outFile, data
    );
  } catch(ex) {
    console.log('Error writing file ' + outFile, ex);
  }
}

function batchWrite(items, cb) {
  var i = 0;
  _.each(items, function(obj, k) {
    var fileOutPath = outPath + typeConfig.output;

    if (!typeConfig.outputSingleFile) {
      fileOutPath += i % 10; 
    }

    writeFile(obj, fileOutPath);
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
      row.etype = etype;
      row.idx = etype + '-' + today.format("YYYY.MM.DD");
      if (typeConfig.idColumn) {
        row.Id = row[typeConfig.idColumn];
      }
      
      i++;
      if (i % 10000 == 0) {
        console.log(i, row.Id);
      }
      
      if (typeConfig.rowHandler) {
        typeConfig.rowHandler(row);
      }

      batchRequestStream.write(row);
    });

    request.on('error', errorHandler);
    request.on('done', function(affected) {
      setTimeout(function () {
        // Always emitted as the last one 
        request.connection.close();
        cb();
      }, 15000);
    });
  }).catch(errorHandler);
});

gulp.task('clean', function() {
  return del([outPath + '**/*']);
});

gulp.task('clean-gz', function() {
  return del([outPath + '*.gz']);
});

gulp.task('process', function(cb) {
  glob(outPath + '**/*', function(er, files) {
    if (er) {
      cb(er)
    }

    async.eachSeries(files, processFile, cb);
  });
});

gulp.task('upload', function(cb) {
  uploadTasks.push(cb);
  runSequence.apply(null, uploadTasks);
});

gulp.task('default', function(cb) {
  runSequence('clean', 'export', 'process', 'upload', cb);
});

gulp.task('test', function(cb) {
  runSequence('clean', 'export', 'process', cb);
});

gulp.task('restart', function(cb) {
  runSequence('clean-gz', 'process', 'upload', cb);
});
