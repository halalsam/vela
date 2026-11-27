import { Hono } from 'hono';
import { requireUser } from '../auth/middleware';
import { adminOnly, staffOnly, type AdminEnv } from '../auth/staff';
import * as admin from '../controllers/admin.controller';
import * as content from '../controllers/adminContent.controller';
import * as support from '../controllers/adminSupport.controller';

/** The staff API behind the admin site. Everything needs a staff account; routes marked adminOnly need an admin. */
export const adminRoutes = new Hono<AdminEnv>()
  .use('/v1/admin/*', requireUser, staffOnly)
  .get('/v1/admin/me', admin.me)
  // Orders, coupons, credit
  .get('/v1/admin/orders', admin.listOrders)
  .get('/v1/admin/orders/:id', admin.getOrder)
  .post('/v1/admin/orders/:id/refund', adminOnly, admin.refundOrder)
  .post('/v1/admin/orders/:id/invoice', admin.issueInvoice)
  .get('/v1/admin/coupons', admin.listCoupons)
  .post('/v1/admin/coupons', adminOnly, admin.createCoupon)
  .patch('/v1/admin/coupons/:code', adminOnly, admin.updateCoupon)
  .post('/v1/admin/users/:id/credit', adminOnly, admin.grantCredit)
  // Blog, SEO, uploads
  .get('/v1/admin/blog', content.listPosts)
  .post('/v1/admin/blog', content.createPost)
  .get('/v1/admin/blog/:id', content.getPost)
  .patch('/v1/admin/blog/:id', content.updatePost)
  .delete('/v1/admin/blog/:id', adminOnly, content.deletePost)
  .get('/v1/admin/seo', content.getSeo)
  .put('/v1/admin/seo/site', adminOnly, content.saveSite)
  .put('/v1/admin/seo/pages/:key/:locale', adminOnly, content.savePage)
  .delete('/v1/admin/seo/pages/:key/:locale', adminOnly, content.resetPage)
  .post('/v1/admin/uploads', content.uploadSizeLimit, content.createUpload)
  .get('/v1/admin/uploads', content.listUploads)
  .delete('/v1/admin/uploads/:id', adminOnly, content.deleteUpload)
  // Support inbox
  .get('/v1/admin/staff', support.listStaff)
  .get('/v1/admin/conversations', support.listConversations)
  .get('/v1/admin/conversations/stats', support.stats)
  .get('/v1/admin/conversations/:id', support.getConversation)
  .post('/v1/admin/conversations/:id/messages', support.reply)
  .patch('/v1/admin/conversations/:id', support.updateConversation)
  .post('/v1/admin/customers/:id/conversations', support.startConversation)
  .get('/v1/admin/saved-replies', support.listSavedReplies)
  .post('/v1/admin/saved-replies', support.createSavedReply)
  .patch('/v1/admin/saved-replies/:id', support.updateSavedReply)
  .delete('/v1/admin/saved-replies/:id', adminOnly, support.deleteSavedReply)
  // Customers and broadcasts
  .get('/v1/admin/customers', support.listCustomers)
  .get('/v1/admin/customers/:id', support.getCustomer)
  .put('/v1/admin/customers/:id/tags', support.setTags)
  .get('/v1/admin/tags', support.allTags)
  .get('/v1/admin/broadcasts', support.listBroadcasts)
  .post('/v1/admin/broadcasts/audience', support.audience)
  .post('/v1/admin/broadcasts', adminOnly, support.createBroadcast)
  .get('/v1/admin/audit', admin.recentAudit);
