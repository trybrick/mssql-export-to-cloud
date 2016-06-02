var gulp = require('gulp');
var gzip = require('gulp-gzip');
var s3 = require('gulp-s3-upload');
var json2csv = require('json2csv');
var sql = require('mssql');
var fs = require('fs');
var util = require('gulp-util');
var moment = require('moment');
var runSequence = require('run-sequence');

var config = require('./config.js')
var etype = util.env.etype || 'product';
var today = moment(new Date());

var typeConfig = config.etypes[etype];
console.log(typeConfig);

gulp.task('export', function(cb) {
  var conn = null;
  var stream = fs.createWriteStream(typeConfig.output);
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
      row.type = etype;
      row.Id = row[typeConfig.idColumn];
      i++;
      if (i % 10000 == 0) {
        console.log(i, row.Id);
      }
      stream.write(JSON.stringify(row) + '\n');
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
  return gulp.src(typeConfig.output, {
    buffer: false
  })
    .pipe(gzip())
    .pipe(gulp.dest('build'))
    .pipe(s3({
      Bucket: 'brick-workspace',
      manualContentEncoding: 'gzip',
      keyTransform: function(relative_filename) {
        // add yy mm dd to filename
        var new_name = 'exports/' + today.format("YYYYMMDD") + '/' + relative_filename;
        // or do whatever you want 
        return new_name;
      }
    }));
});

gulp.task('default', function(cb) {
  runSequence('export', 'upload', cb);
});
