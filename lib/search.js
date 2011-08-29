var _ = require('underscore')
  , pg = require('pg').native;

if (!process.env.RETS_RW) {
  console.log(
    'Postgres connections string not set in'
    + 'environment variable RETS_RW!'
  );
  process.exit(1);
}

_.mixin(require('underscore.string'));

var connString = process.env.RETS_RW;
var client = new pg.Client(connString);
client.connect();

// SearchType: ResourceID
// Class: ClassName
// Query:
// QueryType: 'DMQL2'
// Count: 0|1|2
// Format: COMPACT|COMPACT-DECODED|STANDARD-XML|JSON
// Limit: "NONE"|1*9DIGIT
// Offset: 1*9DIGIT
// Select: field*(, field)
// StandardNames: 0|1

module.exports = [
  function (req, res, next) {
    req.data = {
      ReplyCode: 0,
      ReplyText: 'OK'
    };

    next();
  },
  function (req, res, next) {
    console.log('validate SearchType');

    if (!req.rets_params.searchtype) {
      next(new Error('Missing required param SearchType'));
      return;
    }
    var System = req.system.metadata.System;
    var Resource = System.Resource[ req.rets_params.searchtype ];

    if (!Resource) {
      next(new Error('Invalid SearchType'));
      return;
    }

    next();
  },
  function (req, res, next) {
    console.log('validate Class');

    if (!req.rets_params.class) {
      next(new Error('Missing required param Class'));
      return;
    }
    var System = req.system.metadata.System;
    var Resource = System.Resource[ req.rets_params.searchtype ];
    var rClass = Resource.Class[ req.rets_params.class ];

    if (!rClass) {
      next(new Error('Invalid Class'));
      return;
    }

    next();
  },
  function (req, res, next) {
    console.log('validate select');
    
    var columns = [];
    if (!req.rets_params.select) {
      next();
      return;
    }

    var System = req.system.metadata.System;
    var Resource = System.Resource[ req.rets_params.searchtype ];
    var rClass = Resource.Class[ req.rets_params.class ];
    var Table = rClass.Table;

    _.each(req.rets_params.select.split(','), function(systemName) {
      var DBName = Table[systemName];
      if (!DBName) console.log('Unable to find DBName for :' + systemName + ':');
      columns.push(DBName);
    });

    req.rets_params.select_columns = columns;
    next();
  },
  function (req, res, next) {
    console.log('count');

    req.rets_params.count || (req.rets_params.count = 1);

    if (req.rets_params.count == 0) {
      next();
      return;
    }

    var System = req.system.metadata.System;
    var Resource = System.Resource[ req.rets_params.searchtype ];
    var sql = _.sprintf('SELECT COUNT(%s) as num FROM %s."%s:%s"'
      , Resource.KeyField
      , req.params.systemid
      , req.rets_params.searchtype 
      , req.rets_params.class
    );

    console.log(sql);
    client.query(sql, function(err, result) {
      if (err) {
        next(new Error(err));
        return;
      }
      req.data.COUNT = result.rows[0].num.toString();

      next();
    });
  },
  function (req, res, next) {
    console.log('/search');
    if (req.rets_params.count == 2) {
      next();
      return;
    }

    var sql = _.sprintf('SELECT %s FROM %s."%s:%s" ORDER BY %s DESC OFFSET %s LIMIT %s'
      , ( req.rets_params.select_columns ? '"' + req.rets_params.select_columns.join('","') + '"' : '*' )
      , req.params.systemid
      , req.rets_params.searchtype 
      , req.rets_params.class
      , req.rets_params.sortby
      , (req.rets_params.offset || 0)
      , (req.rets_params.limit || 20)
    );

    console.log(sql);

    client.query(sql, function(err, result) {
      if (err) { 
        next(new Error(err));
        return;
      }

      var System = req.system.metadata.System;
      var Resource = System.Resource[ req.rets_params.searchtype ];
      var RClass = Resource.Class[ req.rets_params.class ];
        
      var DBName_to_SystemName = {};

      _.each(RClass.Table, function(column) {
        DBName_to_SystemName[column.DBName] = column.SystemName;
      });

      var data = [];
      var columns = [];

      _.each(result.rows, function(row, index) {
        if (index === 0) {
          columns = _.map(row, function(val, key) {
            return DBName_to_SystemName[key];
          });
          req.data.COLUMNS = columns;
        }

        data.push(_.values(row));
      });
      
      req.data.DATA = data;
      next();
    });
  }
];
