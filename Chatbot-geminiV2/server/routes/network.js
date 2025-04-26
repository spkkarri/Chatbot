const express = require('express');
const router = express.Router();
const os = require('os');

function getAllIPs() {
    const interfaces = os.networkInterfaces();
    const ips = new Set(['localhost']); // Include localhost by default

    for (const [name, netInterface] of Object.entries(interfaces)) {
        // Skip loopback and potentially virtual interfaces if desired
        if (name.includes('lo') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vmnet')) continue;

        for (const addr of netInterface) {
            // Focus on IPv4, non-internal addresses
            if (addr.family === 'IPv4' && !addr.internal) {
                ips.add(addr.address);
            }
        }
    }
    return Array.from(ips);
}

router.get('/ip', (req, res) => {
    res.json({
        ips: getAllIPs(),
        // req.ip might be less reliable behind proxies, but can be included
        // currentRequestIp: req.ip
    });
});

module.exports = router;
