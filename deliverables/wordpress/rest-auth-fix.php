<?php
/**
 * Plugin Name: REST Auth Header Fix (masports)
 * Description: بعضی هاست‌ها هدر Authorization را حذف می‌کنند و «رمز عبور برنامه» وردپرس کار نمی‌کند. این افزونه همان اطلاعات را از هدر جایگزین X-Authorization می‌خواند. رمزها همچنان توسط خود وردپرس بررسی می‌شوند.
 * Version: 1.0
 */
if ( empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
	foreach ( array( 'HTTP_X_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION' ) as $key ) {
		if ( ! empty( $_SERVER[ $key ] ) ) {
			$_SERVER['HTTP_AUTHORIZATION'] = $_SERVER[ $key ];
			break;
		}
	}
}
if ( empty( $_SERVER['PHP_AUTH_USER'] ) && ! empty( $_SERVER['HTTP_AUTHORIZATION'] )
	&& 0 === stripos( $_SERVER['HTTP_AUTHORIZATION'], 'basic ' ) ) {
	$decoded = base64_decode( substr( $_SERVER['HTTP_AUTHORIZATION'], 6 ), true );
	if ( false !== $decoded && false !== strpos( $decoded, ':' ) ) {
		list( $_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW'] ) = explode( ':', $decoded, 2 );
	}
}
