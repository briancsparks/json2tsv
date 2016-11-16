
/**
 *
 */

var sg                = require('sgsg');
var _                 = sg._;
var fs                = require('fs');
var convertLib        = require('./lib/convert');

var die               = sg.die;
var argvExtract       = sg.argvExtract;

var json2tsv          = {};

_.each(json2tsv, function(value, key) {
  exports[key] = value;
});

sg.exportify(module, convertLib);

