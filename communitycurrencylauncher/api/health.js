const { whatsappService, pluggyService } = require('./_lib/services');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'healthy',
    services: {
      whatsapp: typeof whatsappService.isHealthy === 'function' ? whatsappService.isHealthy() : true,
      pluggy: typeof pluggyService.isHealthy === 'function' ? pluggyService.isHealthy() : true,
      twilioWhatsApp: !!process.env.TWILIO_AUTH_TOKEN,
    },
  });
};

