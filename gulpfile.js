var gulp = require('gulp');
var gzip = require('gulp-gzip');
var s3 = require('gulp-s3-upload');
var json2csv = require('json2csv');
var sql = require('mssql');
var fs = require('fs');
var util = require('gulp-util');

var config = require('./config.js')
var etype = util.env.etype || 'products';

gulp.task('export', function(cb) {
  var conn = null;
  var errorHandler = function errorHandler(err) {
    if (err) {
      console.log(err);

      cb(err);
      return;
    }
  };
  var typeConfig = config.etypes[etype];
  console.log(typeConfig);
  var Db = sql.connect(config.mssql);
  var query = 'SELECT * FROM ' + typeConfig.table;
  Db.then(function() {
    var request = new sql.Request();
    request.stream = true;
    request.query(query);
    request.on('recordset', function(columns) {
      // Emitted once for each recordset in a query 
    });

    request.on('row', function(row) {
      // Emitted for each row in a recordset 
      fs.appendFileSync(typeConfig.output, JSON.stringify(row) + '\n');
    });

    request.on('error', errorHandler);

    request.on('done', function(affected) {
      // Always emitted as the last one 
      console.log(affected);
      cb();
    });
  }).catch(errorHandler);
});

gulp.task('upload', function() {
  return gulp.src('result_csv.gz', {
    buffer: false
  })
    .pipe(gzip())
    .pipe(gulp.dest('./build'))
    .pipe(s3({
      Bucket: process.env.S3_BUCKET,
      ACL: 'public-read',
      manualContentEncoding: 'gzip'
    }));
});