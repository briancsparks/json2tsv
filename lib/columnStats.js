
/**
 *
 */

var sg                = require('sgsg');
var _                 = sg._;

var die               = sg.die;
var argvExtract       = sg.argvExtract;
var argvGet           = sg.argvGet;

var libCStats         = {};

libCStats.Stats = function() {
  var self = this;

  self.addElement = function(elt) {
  };
};

_.each(libCStats, function(value, key) {
  exports[key] = value;
});



