import * as contactRepo from '../repositories/contact.repo.js';
import * as accessRepo from '../repositories/accessRequest.repo.js';

/** Expose les compteurs de badges à la zone admin (messages / demandes). */
export async function adminBadges(req, res, next) {
  try {
    const [unreadMessages, pendingRequests] = await Promise.all([
      contactRepo.countUnread(),
      accessRepo.countPending(),
    ]);
    res.locals.unreadMessages = unreadMessages;
    res.locals.pendingRequests = pendingRequests;
    return next();
  } catch (err) {
    return next(err);
  }
}
