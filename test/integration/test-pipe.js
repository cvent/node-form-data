var common = require('../common');
var assert = common.assert;
var http = require('http');
var path = require('path');
var mime = require('mime-types');
var request = require('request');
var fs = require('fs');
var FormData = require(common.dir.lib + '/form_data');
var IncomingForm = require('formidable').IncomingForm;

var remoteFile = 'http://localhost:'+common.staticPort+'/unicycle.jpg';

// wrap non simple values into function
// just to deal with ReadStream "autostart"
// Can't wait for 0.10
var FIELDS = [
  {name: 'my_field', value: 'my_value'},
  {name: 'my_buffer', value: function(){ return new Buffer([1, 2, 3])} },
  {name: 'my_file', value: function(){ return fs.createReadStream(common.dir.fixture + '/unicycle.jpg')} },
  {name: 'remote_file', value: function(){ return request(remoteFile)} }
];

var server = http.createServer(function(req, res) {

  var form = new IncomingForm({uploadDir: common.dir.tmp});

  form.parse(req);

  form
    .on('field', function(name, value) {
      var field = FIELDS.shift();
      assert.strictEqual(name, field.name);
      assert.strictEqual(value, field.value+'');
    })
    .on('file', function(name, file) {
      var field = FIELDS.shift();
      assert.strictEqual(name, field.name);
      assert.strictEqual(file.name, path.basename(field.value.path));
      assert.strictEqual(file.type, mime.lookup(file.name));
    })
    .on('end', function() {
      res.writeHead(200);
      res.end('done');
    });
});

server.listen(common.port, function() {
  var form = new FormData();
  FIELDS.forEach(function(field) {
    // important to append ReadStreams within the same tick
    if ((typeof field.value == 'function')) {
      field.value = field.value();
    }
    form.append(field.name, field.value);
  });

  var request = http.request({
    method: 'post',
    port: common.port,
    path: '/upload',
    headers: form.getHeaders()
  });

  form.pipe(request);

  request.on('response', function(res) {

    // unstuck new streams
    res.resume();

    server.close();
  });
});

process.on('exit', function() {
  assert.strictEqual(FIELDS.length, 0);
});
