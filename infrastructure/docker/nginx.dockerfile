# Production stage
FROM nginx:1.25-alpine

# Set build arguments and environment variables
ARG NGINX_HOST=localhost
ARG API_UPSTREAM=http://backend:3000
ENV NGINX_HOST=${NGINX_HOST}
ENV API_UPSTREAM=${API_UPSTREAM}

# Install additional security packages and dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    openssl \
    pcre \
    zlib \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create nginx user and group with specific UID/GID
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Create necessary directories with proper permissions
RUN mkdir -p /var/cache/nginx \
    /var/log/nginx \
    /etc/nginx/ssl \
    /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/ssl \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chmod 700 /etc/nginx/ssl

# Copy NGINX configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

# Generate Diffie-Hellman parameters for enhanced SSL security
RUN openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048 && \
    chmod 400 /etc/nginx/ssl/dhparam.pem && \
    chown nginx:nginx /etc/nginx/ssl/dhparam.pem

# Copy static files from build context
COPY --chown=nginx:nginx ../../src/web/build/ /usr/share/nginx/html/
RUN find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;

# Create health check script
RUN echo "#!/bin/sh\ncurl -sf http://localhost/health || exit 1" > /usr/local/bin/health-check.sh && \
    chmod +x /usr/local/bin/health-check.sh

# Security hardening
RUN rm -rf /usr/share/nginx/html/index.html && \
    rm -f /etc/nginx/conf.d/default.conf && \
    mkdir -p /var/lib/nginx/body && \
    chown -R nginx:nginx /var/lib/nginx && \
    chmod -R 700 /var/lib/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Set secure file permissions for configuration
RUN chmod 600 /etc/nginx/nginx.conf && \
    chown nginx:nginx /etc/nginx/nginx.conf

# Create custom error pages
RUN echo "404 - Not Found" > /usr/share/nginx/html/404.html && \
    echo "500 - Server Error" > /usr/share/nginx/html/50x.html && \
    chown nginx:nginx /usr/share/nginx/html/*.html && \
    chmod 644 /usr/share/nginx/html/*.html

# Expose ports
EXPOSE 80 443

# Set working directory
WORKDIR /usr/share/nginx/html

# Switch to non-root user
USER nginx

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD /usr/local/bin/health-check.sh

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]