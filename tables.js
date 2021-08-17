
const serverRolesTableName = 'discordroles';
const redeemablesTableName = 'discordredeemables'
const usersTableName = 'users';
const serverWelcomeMessageTableName = 'serverWelcomeMessages';

const serverRolesTable = {
    AttributeDefinitions: [
        {
            AttributeName: 'server',
            AttributeType: 'S'
        },
        {
            AttributeName: 'role',
            AttributeType: 'S'
        }
    ],
    KeySchema: [
        {
            AttributeName: 'server',
            KeyType: 'HASH'
        },
        {
            AttributeName: 'role',
            KeyType: 'RANGE'
        }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    },
    TableName: serverRolesTableName,
    StreamSpecification: {
        StreamEnabled: false
    }
};

const serverWelcomeMessageTable = {
    AttributeDefinitions: [
        {
            AttributeName: 'server',
            AttributeType: 'S'
        }
    ],
    KeySchema: [
        {
            AttributeName: 'server',
            KeyType: 'HASH'
        }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    },
    TableName: serverWelcomeMessageTableName,
    StreamSpecification: {
        StreamEnabled: false
    }
};

const redeemablesTable = {
    AttributeDefinitions: [
        {
            AttributeName: 'server',
            AttributeType: 'S'
        },
        {
            AttributeName: 'tokenId',
            AttributeType: 'S'
        }
    ],
    KeySchema: [
        {
            AttributeName: 'server',
            KeyType: 'HASH'
        },
        {
            AttributeName: 'tokenId',
            KeyType: 'RANGE'
        }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
    },
    TableName: redeemablesTableName,
    StreamSpecification: {
        StreamEnabled: false
    }
};

module.exports = {
    serverRolesTable,
    serverRolesTableName,
    redeemablesTable,
    redeemablesTableName,
    usersTableName,
    serverWelcomeMessageTable,
    serverWelcomeMessageTableName
}