scp test.html qtest:/home/ubuntu/www/test
scp pula_bridge.js qtest:/home/ubuntu/www/test
ssh qtest "chmod -R 755 /home/ubuntu/www/test"
