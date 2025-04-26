const os = require('os');

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = new Set(['localhost']); // Include localhost

    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            // Include IPv4 non-internal addresses
            if (addr.family === 'IPv4' && !addr.internal) {
                ips.add(addr.address);
            }
        }
    }
    return Array.from(ips);
}

function getPreferredLocalIP() {
    const ips = getLocalIPs();
    // Prioritize non-localhost, non-link-local (169.254) IPs
    // Often 192.168.* or 10.* or 172.16-31.* are common private ranges
    return ips.find(ip => !ip.startsWith('169.254.') && ip !== 'localhost' && (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./))) ||
           ips.find(ip => !ip.startsWith('169.254.') && ip !== 'localhost') || // Any other non-link-local
           'localhost'; // Fallback
}

module.exports = { getLocalIPs, getPreferredLocalIP };
