var _ = require('underscore')
  , path = require('path')
  , spawn = require('child_process').spawn
;
_.mixin(require('underscore.string'));

var MAX_DIM = 800
  , MIN_DIM = 20
  , MAX_QUAL = 100
  , DEFAULT_QUAL = 100
  , MIN_QUAL = 20;

var verifyNumInRange = function(num, min, max){
  if(typeof num === 'number'){
    if(num <= max && num >= min){
      return true;
    }
  }
  return false;
};

var dimensionIsValid = function(dim){
  dim = dim - 0;
  return verifyNumInRange(dim, MIN_DIM, MAX_DIM);
};

var qualityIsValid = function(quality){
  quality = quality - 0;
  return verifyNumInRange(quality, MIN_QUAL, MAX_QUAL);
};

module.exports = [
  function(req, res, next) {
    var ID = req.rets_params.id;

    if (!ID) {
      next(new Error('Missing ID'));
      return;
    }

    var ID_as_array = ID.split(':');

    var content_id = ID_as_array[0];
    var object_id = ID_as_array[1];

    if (!content_id.match(/^\w{1,128}$/)) {
      next(new Error('Invalid Content-ID'));
      return;
    }

    if (!object_id.match(/^\d{1,5}$/)) {
      next(new Error('Invalid Object-ID'));
      return;
    }

    req.rets_params.content_id = content_id;
    req.rets_params.object_id = object_id;

    next();
  },

  function(req, res, next) {
    var w = req.rets_params.w
      , h = req.rets_params.h;
    
    if (!w && !h) {
      next();
      return;
    }

    if (!dimensionIsValid(w)) {
      next(new Error('Invalid Width'));
      return;
    }

    if (!dimensionIsValid(h)) {
      next(new Error('Invalid Height'));
      return;
    }
    
    next();
  },

  function(req, res, next) {
    var q = req.rets_params.q;
    
    if (!q) {
      next();
      return;
    }

    if (!qualityIsValid(q)) req.rets_params.q = DEFAULT_QUAL;

    next();
  },

  function(req, res, next) {
    if (req.rets_params.w) {
      next();
      return;
    }

    console.log('RETURNING Original Image');
    
    var systemid = req.params.systemid;
    var content_id = req.rets_params.content_id;
    var object_id = req.rets_params.object_id;

    req.url = _.sprintf('/%s/%s/%s/%s/%s.jpg'
      , systemid 
      , content_id[0] + content_id[1]
      , content_id[0]
      , content_id
      , object_id
    );
    next();
  },

  function(req, res, next) {
    if (!req.rets_params.w) {
      next();
      return;
    }
    
    var systemid = req.params.systemid
      , content_id = req.rets_params.content_id
      , object_id = req.rets_params.object_id
      , w = req.rets_params.w
      , h = req.rets_params.h
      , q = req.rets_params.q;

    var exactPath = _.sprintf('/photos/%s/%s/%s/%s/%s_%s_%s_%s.jpg'
      , systemid 
      , content_id[0] + content_id[1]
      , content_id[2]
      , content_id
      , object_id, w, h, q);

    var originalPath = _.sprintf('/photos/%s/%s/%s/%s/%s.jpg'
      , systemid 
      , content_id[0] + content_id[1]
      , content_id[2]
      , content_id
      , object_id
    );

    var exactPathAbs = path.normalize(__dirname + '/../static' + exactPath);
    var originalPathAbs = path.normalize(__dirname + '/../static' + originalPath);

    var resizeCmd = 'gm';
    var resizeArgs = [
      'convert'
      , originalPathAbs
      , '-resize'
      , w + 'x' + h
      , '-background'
      , 'white'
      , '-compose'
      , 'Copy'
      , '-gravity'
      , 'center'
      , '-extent'
      , w + 'x' + h
      , '-quality'
      , q
      , exactPathAbs ];

    path.exists(exactPathAbs, function(exists) {
      if(exists) {
        req.url = exactPath;
        next();
        return;
      }

      path.exists(originalPathAbs, function(exists) {
        if (exists) {
          var gm = spawn(resizeCmd, resizeArgs)   
          gm.on('exit', function(code, signal) {
            if(code != 0) {
              console.error(code);
              console.error(signal);
              next(new Error('bad gm return code'));
            } else {
              req.url = exactPath;
              next();
            }
          });
        } else {
          next(new Error('unable to find path being requested'));
        }
      });
    });
  }
];
