import {
  searchCatalog,
  listBodyParts,
  listFamilies,
  listMuscleRegions,
  bodyPartsForFocus,
} from '../../services/exerciseCatalog.service.js';
import { asyncHandler, clean, toInt } from '../../utils/http.js';

/** GET /admin/api/exercise-catalog?q=&family=&region=&equipment=&bodyPart=&focus=&session_type= */
export const search = asyncHandler(async (req, res) => {
  const focus = clean(req.query.focus);
  const sessionType = clean(req.query.session_type) || 'full_body';
  const fromFocus = bodyPartsForFocus(focus, sessionType);
  const rows = searchCatalog({
    q: clean(req.query.q) || '',
    bodyPart: clean(req.query.bodyPart) || '',
    bodyParts: fromFocus,
    family: clean(req.query.family) || '',
    region: clean(req.query.region) || '',
    equipment: clean(req.query.equipment) || '',
    limit: toInt(req.query.limit) || 80,
  });
  res.json({ ok: true, count: rows.length, results: rows });
});

export const bodyParts = asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    bodyParts: listBodyParts(),
    families: listFamilies(),
    regions: listMuscleRegions(),
  });
});
