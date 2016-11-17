
/**
 *
 */

var sg                = require('sgsg');
var _                 = sg._;
var moment            = sg.extlibs.moment;
var fs                = require('fs');
var Stats             = require('./columnStats').Stats;

var die               = sg.die;
var argvExtract       = sg.argvExtract;
var argvGet           = sg.argvGet;

var libConvert        = {};

libConvert.convertFile = function(argv, context, callback) {

  var inputFilename     = argvExtract(argv, 'filename,file,in');
  var maxLines          = argvGet(argv, 'max-lines,max');
  var result            = _.extend({}, argv, {items:[]});

  return sg.__run([function(next) {
    return sg.eachLine(inputFilename, null, function(line, lineNum, filename, count) {
      if (maxLines && lineNum >= maxLines) { return; }

      result.items.push(line);

    }, function(err, numLines, numFiles) {
      if (err)  { return die(err, callback); }

      return next();
    });

  }], function() {
    return libConvert.convertJsonItems(result, context, callback);
  });
};

var Json2Tsv = libConvert.Json2Tsv = function(options_) {
  var self              = this;
  var options           = options_ || {};
  var separator         = options.separator || options.sep || '_';

  self.items            = [];

  var columnStats       = {};
  var keyIndexes        = {};
  var maxKeyIndex       = 0;
  var columnNames       = [];
  var defaultRow        = [];

  self.processItems = function(items) {
    if (_.isString(items))    { return self.processItems(items.split('\n')); }

    _.each(items, function(item) {

      //if ((self.items.length % 100) === 0)          { console.error('item: '+self.items.length); }

      var j       = item;
      var jFlat   = {};

      if (_.isString(item)) {
        if (item.replace(/[ \t\n]/g, '').length > 0) {
          j = sg.safeJSONParse(item);
        }
      }

      _.each(j, function(value1, key1) {
        if (!sg.isObject(value1)) { return prepRowItem(jFlat, [key1], value1); }

        _.each(value1, function(value2, key2) {
          if (!sg.isObject(value2)) { return prepRowItem(jFlat, [key1, key2], value2); }

          _.each(value2, function(value3, key3) {
            if (!sg.isObject(value3)) { return prepRowItem(jFlat, [key1, key2, key3], value3); }
          });
        });
      });

      self.items.push(jFlat);
    });
  };

  self.getTsv = function() {

    var items = _.map(self.items, function(item) {
      var arr = _.toArray(defaultRow);
      _.each(item, function(value, key) {
        if (_.isBoolean(value))   { value = value? 1 : 0; }
        if (_.isDate(value))      { value = moment(value).format('YYYY-MM-DDTHH:mm:ss.SSS'); }
        arr[keyIndexes[key]] = value;
      });
      return arr;
    });

    items.unshift(columnNames);

    var tsv = _.map(items, function(item) {
      return item.join('\t');
    }).join('\n');

    return tsv;
  };

  function prepRowItem(obj, keys, value) {
    var type  = _.last(keys);
    if (type in {$oid:true})    { return; }
    else if (type[0] === '$')   { return prepRowItem(obj, _.initial(keys), value); }

    var key = keys.join(separator);
    if (!(key in keyIndexes)) {
      keyIndexes[key]               = maxKeyIndex++;
      columnNames[keyIndexes[key]]  = key;
      defaultRow[keyIndexes[key]]   = '';
      columnStats[key]              = new Stats();
    }

    obj[key]          = value;

    columnStats[key].addElement(value);
  }
};

libConvert.convertJsonItems = function(argv, context, callback) {

  // Make sure we have items and that it is an array
  if (!('items' in argv))   { return die('ENEED --items', callback, 'convertJsonItems'); }

  var items             = argvExtract(argv, 'items');
  if (!_.isArray(items)) {
    return libConvert.convertJsonItems(_.extend({}, argv, {items:items.split('\n')}), context, callback);
  }

  var result            = {};
  var maxItems          = argvExtract(argv, 'max-items,max');

  var columnStats       = {};
  var keyTypes          = {};
  var keyIndexes = {}, maxKeyIndex = 0, columnNames = [], defaultRow = [];

  var prepRowItem = function(obj, keys, value) {
    var type  = _.last(keys);
    if (type in {$oid:true})    { return; }
    else if (type[0] === '$')   { return prepRowItem(obj, _.initial(keys), value); }

    var key = keys.join('_');
    if (!(key in keyIndexes)) {
      keyIndexes[key]               = maxKeyIndex++;
      columnNames[keyIndexes[key]]  = key;
      defaultRow[keyIndexes[key]]   = '';
      columnStats[key]              = new Stats();
    }

    obj[key]          = value;

    columnStats[key].addElement(value);
  };

  var json = [];
  var json2Tsv = new Json2Tsv();

  return sg.__run([function(next) {
    json2Tsv.processItems(items);
    return next();

  }], function() {

    result.count  = json2Tsv.items.length;
    result.tsv = json2Tsv.getTsv();
    return callback(null, result);
  });
};

_.each(libConvert, function(value, key) {
  exports[key] = value;
});


