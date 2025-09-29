\d plugin_marketplace_apps;
SELECT COUNT(*) FROM plugin_marketplace_apps;
SELECT execution_url FROM plugin_marketplace_apps WHERE status = 'approved' LIMIT 3;
