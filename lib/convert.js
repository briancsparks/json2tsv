
/**
 *
 */

var sg                = require('sgsg');
var _                 = sg._;
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
  return sg.__run([function(next) {
    console.error('Processing items', items.length);
    _.each(items, function(line, lineNum) {
      if (maxItems && lineNum >= maxItems) { return; }
      if ((lineNum % 5000) === 0)          { console.error('line: '+lineNum); }

      var index;
      var j       = line;
      var jFlat   = {};

      if (_.isString(line)) {
        if (line.replace(/[ \t\n]/g, '').length > 0) {
          try {
            j = JSON.parse(line);
          } catch(err) {
            //return die(err, callback, 'convert.JSON.parse');
          }
        }
      }

      _.each(j, function(value1, key1) {
        if (_.isArray(value1))          {}
        else if (!_.isObject(value1))   {
          return prepRowItem(jFlat, [key1], value1);
        }

        _.each(value1, function(value2, key2) {
          if (_.isArray(value2))          {}
          else if (!_.isObject(value2))   {
            return prepRowItem(jFlat, [key1, key2], value2);
          }

          //_.each(value1, function(value2, key2) { });
        });
      });

      json.push(jFlat);
    });

    return next();

  //---------------------------------------------------------------------
  // Change the items (which are objects) into arrays
  //---------------------------------------------------------------------
  }, function(next) {

    console.error('turning objects into arrays');
    json = _.map(json, function(item) {
      var arr = _.toArray(defaultRow);
      _.each(item, function(value, key) {
        if (_.isBoolean(value))   { value = value? 1 : 0; }
        arr[keyIndexes[key]] = value;
      });
      return arr;
    });
    return next();

  }, function(next) {
    console.error('adding header');
    json.unshift(columnNames);
    return next();

  }, function(next) {
    return next();

  }], function() {
    result.count  = json.length;

    result.tsv = _.map(json, function(item) {
      return item.join('\t');
    }).join('\n');

    return callback(null, result);
  });
};

_.each(libConvert, function(value, key) {
  exports[key] = value;
});


