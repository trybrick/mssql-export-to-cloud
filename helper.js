var path = require('path');
var async = require('async');
var fs = require('fs');
var AWS = require('aws-sdk');
var zlib = require('zlib');

function uploadMultipart(absoluteFilePath, fileName, config, uploadCb) {
  var s3 = new AWS.S3();
  var bucketName = config.bucketName;
  s3.createMultipartUpload({
    Bucket: bucketName,
    Key: fileName
  }, (mpErr, multipart) => {
    if (!mpErr) {
      //console.log("multipart created", multipart.UploadId);
      fs.readFile(absoluteFilePath, (err, fileData) => {

        var partSize = 1024 * 1024 * 5;
        var parts = Math.ceil(fileData.length / partSize);

        async.timesSeries(parts, (partNum, next) => {

          var rangeStart = partNum * partSize;
          var end = Math.min(rangeStart + partSize, fileData.length);

          console.log("uploading ", fileName, " % ", (partNum / parts).toFixed(2));

          partNum++;
          async.retry((retryCb) => {
            s3.uploadPart({
              Body: fileData.slice(rangeStart, end),
              Bucket: bucketName,
              Key: fileName,
              PartNumber: partNum,
              UploadId: multipart.UploadId
            }, (err, mData) => {
              retryCb(err, mData);
            });
          }, (err, data) => {
            //console.log(data);
            next(err, {
              ETag: data.ETag,
              PartNumber: partNum
            });
          });

        }, (err, dataPacks) => {
          s3.completeMultipartUpload({
            Bucket: bucketName,
            Key: fileName,
            MultipartUpload: {
              Parts: dataPacks
            },
            UploadId: multipart.UploadId
          }, uploadCb);
        });
      });
    } else {
      uploadCb(mpErr);
    }
  });
}

function uploadFile(absoluteFilePath, config, uploadCb) {
  var s3 = new AWS.S3();
  var bucketName = config.bucketName;
  var fileName = path.basename(absoluteFilePath);
  var stats = fs.statSync(absoluteFilePath)
  var fileSizeInBytes = stats["size"]

  if (fileSizeInBytes < (1024 * 1024 * 5)) {
    async.retry((retryCb) => {
      fs.readFile(absoluteFilePath, (err, fileData) => {
        s3.putObject({
          Bucket: bucketName,
          Key: fileName,
          Body: fileData
        }, retryCb);
      });
    }, uploadCb);
  } else {
    uploadMultipart(absoluteFilePath, fileName, uploadCb)
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

module.exports = {
  uploadFile: uploadFile,
  compressFile: compressFile
}
