# Email-to-Lead Configuration Guide

This guide explains how to configure the email-to-lead conversion system for SUKI CRM.

## Overview

The system automatically:
- Connects to your email inboxes (Gmail, Outlook, etc.)
- Fetches new emails
- Classifies them as "Enquiry" or "General" using keyword matching
- Auto-creates leads for enquiry emails
- Logs all processed emails in the CRM

## Configuration Options

### Option 1: Single Account (Existing)

Use the existing single-account poller if you only have one email account.

**Run:**
```bash
npm run email:poll
```

**Configuration (.env):**
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASS=your_app_password
IMAP_MAILBOX=INBOX
IMAP_PROCESSED_FOLDER=Processed
```

### Option 2: Multi-Account (New)

Use the multi-account poller if you have multiple email accounts (Gmail + Outlook).

**Run:**
```bash
npm run email:poll:multi
```

**Watch Mode (auto-poll every 5 minutes):**
```bash
npm run email:poll:multi -- --watch
```

**Configuration (.env):**
```env
# List your accounts (comma-separated)
EMAIL_ACCOUNTS=gmail,outlook

# Gmail Configuration
GMAIL_HOST=imap.gmail.com
GMAIL_PORT=993
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_app_password
GMAIL_MAILBOX=INBOX
GMAIL_PROCESSED_FOLDER=Processed

# Outlook Configuration
OUTLOOK_HOST=outlook.office365.com
OUTLOOK_PORT=993
OUTLOOK_USER=your_email@outlook.com
OUTLOOK_PASS=your_password
OUTLOOK_MAILBOX=INBOX
OUTLOOK_PROCESSED_FOLDER=Processed
```

## Setting Up Email Accounts

### Gmail Setup

1. **Enable IMAP in Gmail:**
   - Go to Gmail Settings → Forwarding and POP/IMAP
   - Enable IMAP
   - Save changes

2. **Generate App Password (Required):**
   - Go to Google Account → Security
   - Enable 2-Step Verification (if not enabled)
   - Go to App Passwords
   - Create a new app password for "Mail"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
   - Use this password in `GMAIL_PASS` (remove spaces: `abcdefghijklmnop`)

**Note:** Gmail app passwords are required because regular passwords don't work with IMAP anymore.

### Outlook/Office 365 Setup

1. **Enable IMAP in Outlook:**
   - Go to Outlook Settings → Mail → Sync email
   - Enable IMAP

2. **Use your regular password** or create an app password if 2FA is enabled:
   - If 2FA is enabled, go to Microsoft Account → Security → App passwords
   - Create a new app password
   - Use this in `OUTLOOK_PASS`

### Other Email Providers

**Yahoo:**
```env
YAHOO_HOST=imap.mail.yahoo.com
YAHOO_PORT=993
YAHOO_USER=your_email@yahoo.com
YAHOO_PASS=your_app_password
```

**Custom Email Server:**
```env
CUSTOM_HOST=mail.yourdomain.com
CUSTOM_PORT=993
CUSTOM_USER=your_email@yourdomain.com
CUSTOM_PASS=your_password
```

## Keyword Configuration

The system uses keywords to classify emails. These are defined in `lib/email-classification.ts`.

**Include Keywords (Enquiry):**
- requirement, requirements
- enquiry, enquiry, inquiry, inquiries
- interested, interested in
- looking for
- quotation, quote, request for quote, RFQ
- pricing, price list, price quote, best price, rate
- product inquiry, product enquiry
- purchase, purchase order, PO
- procurement, sourcing, supplier
- bulk order, bulk enquiry
- sample request, send sample
- catalogue, catalog
- specification, spec sheet
- MOQ, minimum order quantity
- lead time, delivery time
- availability, in stock
- proposal, business proposal
- collaboration, partnership
- demo request, schedule a call
- please share details, more information, more details

**Exclusion Keywords (General):**
- unsubscribe, newsletter, no-reply, noreply
- automated, notification
- promotion, promotional, offer expires
- invoice, payment received, receipt
- job application, resume, cv attached

To add or modify keywords, edit `lib/email-classification.ts`.

## Testing

1. **Single run:**
   ```bash
   npm run email:poll:multi
   ```

2. **Watch mode (continuous polling):**
   ```bash
   npm run email:poll:multi -- --watch
   ```

3. **Check logs:**
   - The poller logs each email processed
   - Check classification results
   - Verify leads are created in CRM

4. **View processed emails:**
   - Go to CRM → check InboundEmailLog table
   - Filter by classification, status, etc.

## Automation

### Method 1: Cron Job (Linux/Mac)

Add to crontab:
```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/CRM && npm run email:poll:multi
```

### Method 2: Windows Task Scheduler

1. Create a batch file `poll-emails.bat`:
   ```batch
   cd "C:\Users\ajithkumar\Desktop\CRM NEW Requirement"
   npm run email:poll:multi
   ```

2. Open Task Scheduler
3. Create new task → Trigger every 5 minutes
4. Action: Run the batch file

### Method 3: Watch Mode

Run the watch mode in the background:
```bash
npm run email:poll:multi -- --watch
```

This will auto-poll every 5 minutes (configurable via `INBOUND_POLL_INTERVAL_MS`).

## Troubleshooting

### Gmail Authentication Error
- Ensure you're using an App Password, not your regular password
- Check that IMAP is enabled in Gmail settings
- Verify 2-Step Verification is enabled

### Outlook Authentication Error
- Check IMAP is enabled in Outlook settings
- If 2FA is enabled, use an App Password
- Verify host is `outlook.office365.com`

### No Emails Being Processed
- Check that the mailbox name is correct (usually `INBOX`)
- Verify the email account has unread emails
- Check logs for connection errors

### Duplicate Leads
- The system automatically deduplicates by email address
- Check `InboundEmailLog` table for duplicate message IDs

### Too Many False Positives
- Adjust keywords in `lib/email-classification.ts`
- Add more exclusion keywords
- Increase confidence threshold in classification logic

## Security Notes

- **Never commit real passwords to git**
- Use environment variables for sensitive data
- Rotate app passwords periodically
- Use separate app passwords for different applications
- Monitor InboundEmailLog for suspicious activity

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify email account settings
3. Test IMAP connection using an email client
4. Check the InboundEmailLog table for processing history