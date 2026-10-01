FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY lesson-1.html /usr/share/nginx/html/lesson-1.html
COPY lesson-2.html /usr/share/nginx/html/lesson-2.html
COPY robots.txt /usr/share/nginx/html/robots.txt
EXPOSE 80
