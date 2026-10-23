import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

let client = null;

function getClient() {
    if (!client) {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('DATABASE_URL environment variable is required to connect to the database');
        }
        client = neon(dbUrl);
    }
    return client;
}

const sql = new Proxy(function () {}, {
    apply(_target, thisArg, argArray) {
        return Reflect.apply(getClient(), thisArg, argArray);
    },
    get(_target, prop, receiver) {
        const activeClient = getClient();
        const value = Reflect.get(activeClient, prop, receiver);
        if (typeof value === 'function') {
            return value.bind(activeClient);
        }
        return value;
    }
});

export default sql;

