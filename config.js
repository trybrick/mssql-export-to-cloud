module.exports = {
  mssql: {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASS,
    server: '172.25.46.74',
    driver: 'tedious',
    database: 'ExpressLaneAdmin',
    connectionTimeout: 5000,
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
  etypes: {
    product: {
      table: 'dbo.ProductSearch WITH (NOLOCK)',
      output: 'products_csv.gz',
      idColumn: 'ProductID',
      rowHandler: function(row) {
        row.ChainList = (row.ChainList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    circular: {
      table: 'dbo.CircularItemSearch WITH (NOLOCK)',
      output: 'circulars_csv.gz',
      idColumn: 'CircularItemID',
      rowHandler: function(row) {
        row.SkillLevelList = (row.SkillLevelList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
        row.NutritionList = (row.NutritionList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
        row.AttributeList = (row.AttributeList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    },
    recipe: {
      table: 'dbo.RecipeSearchIndex WITH (NOLOCK)',
      output: 'recipes_csv.gz',
      idColumn: 'RecipeID',
      rowHandler: function(row) {
        row.StoreList = (row.StoreList || '').replace(/^(\|)+|(\|)+$/gm, '').split('|');
      }
    }
  }
};
