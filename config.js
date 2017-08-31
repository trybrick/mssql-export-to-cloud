var fs = require('fs');
var env = process.env;

if (fs.existsSync('./.env.json')) {
  env = require('./.env.json');
}

module.exports = {
  mssql: {
    user: env.MSSQL_USER,
    password: env.MSSQL_PASS,
    server: 'mssqlprod01.gsn2.com',
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
      appName: 'sqlexport'
    }
  },
  aws: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION || 'us-west-2'
  },
  etypes: {
    products: {
      query: 'SELECT ProductID, UPC, ProductChainID, ProductDescription, BrandName, ItemExtendedSize, UnitOfMeasureID, ItemSize, ChainList, Department, Aisle, Category, Shelf, SearchText, ProductCode, UPC11 FROM dbo.ProductSearch WITH (NOLOCK)',
      output: 'product_jsline',
      compressFile: true,
      idColumn: 'ProductID',
      rowHandler: function(row) {
        row.ChainList = (row.ChainList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    circulars: {
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
    recipes: {
      query: 'SELECT * FROM dbo.RecipeSearchIndex WITH (NOLOCK)',
      output: 'recipe_jsline',
      compressFile: true,
      idColumn: 'RecipeID',
      rowHandler: function(row) {
        row.StoreList = (row.StoreList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    profile: {
      query: 'SELECT TOP 10000 SiteId, Id, PrimaryStoreId FROM dbo.vwProfile WHERE Email IS NOT NULL',
      output: 'profile.csv',
      compressFile: false,
      outputSingleFile: true,
      headers: ['Id', 'SiteId', 'PrimaryStoreId'],
      delimiter: ',',
      rowDelimiter: '\n'
    },
    productdb: {
      query: 'SELECT [upc], [name], [brand], [department], [aisle], [cat], [shelf], [imageurl] as img FROM [dbo].[Product2] WITH (NOLOCK)',
      output: 'products.psv',
      compressFile: false,
      outputSingleFile: true,
      headers: ['upc', 'name', 'brand', 'department', 'aisle', 'category', 'shelf', 'img'],
      delimiter: '|',
      rowDelimiter: '\n'
    }
  }
};
