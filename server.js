const express = require('express')
  , _ = require('underscore')
  , RETSSystem = require('../Model-RETS-System')
  , systems = {}
  , search = require('./lib/search')
  , photo = require('./lib/photo')
  , fs = require('fs')

_.mixin(require('underscore.string'));

var app = express.createServer();

app.register('.xml', require('ejs'));
app.set('view engine', 'xml');

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.responseTime());
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(app.router);
  app.use(function(err, req, res, next){
    // if there's an error, always just show a basic 404
    if(err){
      console.log(err);
      res.send('resource not found', 404);
    }else{
      next();
    }
  });
  app.use(express.static(__dirname + '/photos'));
});

app.get('/', function(req, res) {
  res.send('Data Feed Service');
});

function normalize(req, res, next) {
  var normal = {};
 
  _.each(req.query, function(value, key) {
    normal[ key.toLowerCase() ] = value;
  });
  
  req.rets_params = normal;
  next();
}

function auth(req, res, next) { 
  if (req.rets_params.apikey) {
    next() 
  } else {
    //next(new Error('Invalid or Missing API Key'));
    next();
  }
}

function system(req, res, next) {
  if (!req.params.systemid) {
    next(new Error('Invalid or Missing SystemID'));
  } else {
    load_metadata(req.params.systemid, function(err, system) {
      req.system = system;
      next();
    });
  }
}

function load_metadata(SystemID, cb) {
  var system = systems[SystemID];
  if(system) {
    cb(null, system);
    return;
  }  

  RETSSystem({ SystemID: SystemID }, function(err, result) {
    if (err) {
      cb(err);
      return;
    }

    system = systems[SystemID] = result;
    cb(null, system);
  });
}

app.get('/:systemid/GetMetadata', function(req, res) {
  console.log('/metadata');

  var SystemID = req.param('systemid');
  var api_key = req.param('api_key');

  load_metadata(SystemID, function(err, system) {
    if (err) {
      console.log(err);
      res.send(500);
      return;
    }

    res.contentType('json');
    res.send(system.metadata);
  });
});

app.get('/:systemid/Search', normalize, auth, system, search, function(req, res) {
  res.send(req.data, { 'Content-Type': 'text/plain' });
});

app.get('/:systemid/GetObject', normalize, auth, photo, function(req, res, next){
  next();
});

app.dynamicHelpers({
  script: function(req) {
    return function(path) {
      return fs.readFileSync('./views/js/' + path, 'utf8');
    };
  },
  lib: function(req) {
    return function(path) {
      return fs.readFileSync('../lib/' + path, 'utf8');
    };
  },
  css: function(req) {
    return function(path) {
      return fs.readFileSync('./views/css/' + path, 'utf8');
    };
  },
  ich: function(req) {
    return function(path) {
      return fs.readFileSync('./templates/' + req.param('systemid') + '/' + path, 'utf8');
    };
  },
  js: function(req) {
    return function(path) {
      return fs.readFileSync('./templates/' + req.param('systemid') + '/' + path, 'utf8');
    };
  }
});

app.get('/:systemid/GadgetSpec', function(req, res, next) {
  res.render('spec', { layout: false, locals: { SystemID: req.param('systemid') } });
});

app.listen(3000);
console.log('Data service started on port 3000');
