var gulp = require('gulp');
var gzip = require('gulp-gzip');
var s3 = require('gulp-s3-upload');
var json2csv = require('json2csv');
var sql = require('mssql');

var config = require('./config.js')


gulp.task('export', function(cb) {
  var conn = null;
  var errorHandler = function errorHandler(err) {
    if (err) {
      console.log(err);
      if (conn) {
        conn.close();
      }
      cb(err);
      return;
    }
  };
  var Db = sql.connect(config.mssql);
  var query = 'SELECT * FROM dbo.CircularItemSearch WITH (NOLOCK)';
  Db.then(function() {
    new sql.Request().query(query).then(function(records) {

      console.log(records.length);
      json2csv({
        data: records
      }, function(err, csv) {
        if (err) {
          throw new Error('CSV export: ' + err);
        }
        fs.writeFile(config.output, csv);
        cb();
      });

    }).catch(errorHandler);
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