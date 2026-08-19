@echo off
cd "C:\Users\ajithkumar\Desktop\CRM NEW Requirement"
echo Starting Email Poller at %date% %time%
npm run email:poll:multi
echo Email Poller completed at %date% %time%
pause