var fs = require('fs');
var env = process.env;

if (fs.existsSync('./.env.json')) {
  env = require('./.env.json');
}

module.exports = {
  mssql: {
    user: env.MSSQL_USER,
    password: env.MSSQL_PASS,
    server: '172.25.46.74',
    driver: 'tedious',
    database: 'ExpressLaneAdmin',
    connectionTimeout: 15000,
    requestTimeout: 15000000,
    pool: {
      max: 200,
      min: 15,
      idleTimeoutMillis: 60000
    },
    options: {
      instanceName: 'gsnweb',
      appName: 'sqlexport'
    }
  },
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION || 'us-west-2'
  },
  etypes: {
    product: {
      query: 'SELECT * FROM dbo.ProductSearch WITH (NOLOCK)',
      output: 'product_jsline',
      compressFile: true,
      idColumn: 'ProductID',
      rowHandler: function(row) {
        row.ChainList = (row.ChainList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    circular: {
      query: 'SELECT * FROM dbo.CircularItemSearch WITH (NOLOCK)',
      output: 'circular_jsline',
      compressFile: true,
      idColumn: 'CircularItemID',
      rowHandler: function(row) {
        row.SkillLevelList = (row.SkillLevelList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
        row.NutritionList = (row.NutritionList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
        row.AttributeList = (row.AttributeList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    recipe: {
      query: 'SELECT * FROM dbo.RecipeSearchIndex WITH (NOLOCK)',
      output: 'recipe_jsline',
      compressFile: true,
      idColumn: 'RecipeID',
      rowHandler: function(row) {
        row.StoreList = (row.StoreList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    profile: {
      query: 'SELECT * FROM dbo.vwProfile WITH (NOLOCK)',
      output: 'profile.csv',
      compressFile: true,
      outputSingleFile: true,
      idColumn: 'Id',
      headers: ['Id', 'FirstName'],
      delimiter: ',',
      rowDelimiter: '\n',
      rowHandler: function(row) {
        row.StoreList = (row.StoreList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    }
  }
};
