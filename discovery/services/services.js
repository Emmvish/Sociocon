const services = {
    user: process.env.USER_SERVICE || 'http://localhost:4001',
    research: process.env.RESEARCH_SERVICE || 'http://localhost:4002',
    bond: process.env.BOND_SERVICE || 'http://localhost:4003',
    request: process.env.REQUEST_SERVICE || 'http://localhost:4004',
    authentication: process.env.AUTHENTICATION_SERVICE || 'http://localhost:4005'
}

module.exports = services;