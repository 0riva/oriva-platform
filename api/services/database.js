"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementUsage = exports.runMany = exports.runSingle = exports.toQueryResult = void 0;
const toQueryResult = (data, error, count, status) => ({
    data,
    error,
    count: count ?? null,
    status
});
exports.toQueryResult = toQueryResult;
const runSingle = async (query) => {
    const { data, error, status } = await query;
    return (0, exports.toQueryResult)(data, error, null, status);
};
exports.runSingle = runSingle;
const runMany = async (query) => {
    const { data, error, count, status } = await query;
    return (0, exports.toQueryResult)(data, error, count, status);
};
exports.runMany = runMany;
const incrementUsage = async (client, keyId, usageCount) => {
    await client
        .from('developer_api_keys')
        .update({
        usage_count: usageCount + 1,
        last_used_at: new Date().toISOString()
    })
        .eq('id', keyId);
};
exports.incrementUsage = incrementUsage;
