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
  output: 'result.csv'
};
