
/**
 *
 */

var sg                = require('sgsg');
var _                 = sg._;
var fs                = require('fs');

var die               = sg.die;
var argvExtract       = sg.argvExtract;
var argvGet           = sg.argvGet;

var libConvert        = {};

libConvert.convertFile = function(argv, context, callback) {

  var inputFilename     = argvExtract(argv, 'filename,file,in');
  var maxLines          = argvGet(argv, 'max-lines,max');
  var result            = _.extend({}, argv, {lines:[]});

  return sg.__run([function(next) {
    return sg.eachLine(inputFilename, null, function(line, lineNum, filename, count) {
      if (maxLines && lineNum >= maxLines) { return; }

      result.lines.push(line);

    }, function(err, numLines, numFiles) {
      if (err)  { return die(err, callback); }

      return next();
    });

  }], function() {
    return libConvert.convertJsonLines(result, context, callback);
  });
};

libConvert.convertJsonLines = function(argv, context, callback) {

  // Make sure we have lines and that it is an array
  if (!('lines' in argv))   { return die('ENEED --lines', callback, 'convertJsonLines'); }

  var lines             = argvExtract(argv, 'lines');
  if (!_.isArray(lines)) {
    return libConvert.convertJsonLines(_.extend({}, argv, {lines:lines.split('\n')}), context, callback);
  }

  var result            = {};
  var maxLines          = argvExtract(argv, 'max-lines,max');

  var keyTypes = {};
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
    }

    obj[key] = value;
  };

  var json = [];
  return sg.__run([function(next) {
    console.error('Processing lines', lines.length);
    _.each(lines, function(line, lineNum) {
      if (maxLines && lineNum >= maxLines) { return; }
      if ((lineNum % 5000) === 0)          { console.error('line: '+lineNum); }

      var index;
      var j = {}, jFlat={};
      if (line.replace(/[ \t\n]/g, '').length > 0) {
        try {
          j = JSON.parse(line);
        } catch(err) {
          //return die(err, callback, 'convert.JSON.parse');
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
  // Change the lines (which are objects) into arrays
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

//    _.each(json, function(item) {
//      console.log(item.join('\t'));
//    });

//    result.json   = json;
    result.lines = _.map(json, function(item) {
      return item.join('\t');
    }).join('\n');

    return callback(null, result);
  });
};

_.each(libConvert, function(value, key) {
  exports[key] = value;
});


