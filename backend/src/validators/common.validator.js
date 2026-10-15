const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid id'),
});

module.exports = { idParamSchema };
