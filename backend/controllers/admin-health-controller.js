const os = require('os');
const mongoose = require('mongoose');
const Student = require('../models/studentSchema');
const Teacher = require('../models/teacherSchema');
const Test = require('../models/testSchema');
const responseTimeTracker = require('../utils/responseTimeTracker');

const DB_STATUS_MAP = {
  0: 'Disconnected',
  1: 'Connected',
  2: 'Degraded',
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

async function getHealthMetrics(req, res) {
  try {
    const { schoolId } = req.params;

    // DB status
    const readyState = mongoose.connection.readyState;
    const dbStatus = DB_STATUS_MAP[readyState] || 'Disconnected';

    // Uptime
    const uptimeSeconds = Math.floor(process.uptime());

    // Memory
    const mem = process.memoryUsage();
    const usedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const totalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const memPercent = totalMB > 0 ? Math.round((usedMB / totalMB) * 1000) / 10 : 0;

    // CPU
    const cpuCount = os.cpus().length || 1;
    const loadAvg = os.loadavg()[0];
    const loadPercent = Math.round((loadAvg / cpuCount) * 100 * 10) / 10;

    // Response time
    const avgMs = responseTimeTracker.avgLast5Min();

    // Collection counts — scoped to school where possible
    const [students, teachers, tests] = await Promise.all([
      Student.countDocuments({ schoolId }),
      Teacher.countDocuments({ schoolId }),
      Test.countDocuments({ school: schoolId }),
    ]);

    // Active connections (HTTP server tracks this via res.socket; use server.getConnections if available)
    // Fallback to 0 — the frontend can display N/A when 0
    const activeConnections = (req.socket && req.socket.server)
      ? await new Promise((resolve) => {
          req.socket.server.getConnections((err, count) => resolve(err ? 0 : count));
        })
      : 0;

    return res.status(200).json({
      db: { status: dbStatus },
      uptime: { seconds: uptimeSeconds, formatted: formatUptime(uptimeSeconds) },
      memory: { usedMB, totalMB, percent: memPercent },
      cpu: { loadPercent },
      connections: { active: activeConnections },
      responseTime: { avgMs },
      collections: { students, teachers, tests },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Health check failed', error: err.message });
  }
}

module.exports = { getHealthMetrics };
