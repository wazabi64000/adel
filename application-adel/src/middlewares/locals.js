import config from '../config/env.js';

/** Variables exposées à tous les templates. */
export function templateLocals(req, res, next) {
  res.locals.appName = config.appName;
  res.locals.appUrl = config.appUrl;
  res.locals.env = config.env;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  res.locals.year = new Date().getFullYear();
  res.locals.today = new Date().toISOString().slice(0, 10);
  res.locals.flash = typeof req.flash === 'function' ? req.flash() : {};
  res.locals.formErrors = {};
  res.locals.formData = {};
  res.locals.seo = {
    title: config.appName,
    description:
      'Coach sportif : accompagnement physique, nutrition et préparation mentale. Programme personnalisé, coaching à distance et préinscription gratuite avec Coach Adel.',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'website',
  };
  next();
}
