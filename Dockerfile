FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY lesson-1.html /usr/share/nginx/html/lesson-1.html
COPY robots.txt /usr/share/nginx/html/robots.txt
EXPOSE 80
