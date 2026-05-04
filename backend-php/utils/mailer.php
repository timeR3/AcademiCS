<?php
declare(strict_types=1);

/**
 * Función para enviar correos usando la API de Microsoft Graph (OAuth 2.0 Client Credentials)
 */
function sendMicrosoftGraphEmail(string $toEmail, string $subject, string $htmlBody, ?string $replyTo = null): bool {
    // 1. Obtener credenciales del entorno
    $tenantId = envValue('GRAPH_TENANT_ID', '');
    $clientId = envValue('GRAPH_CLIENT_ID', '');
    $clientSecret = envValue('GRAPH_CLIENT_SECRET', '');
    $fromEmail = envValue('MAIL_FROM_ADDRESS', 'noreply@thaliavictoria.com.ec');

    if ($tenantId === '' || $clientId === '' || $clientSecret === '') {
        error_log('Error de correo: Faltan credenciales de Microsoft Graph en el archivo .env');
        return false;
    }

    // 2. Obtener Token de Acceso
    $tokenUrl = "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token";
    $tokenData = [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'scope' => 'https://graph.microsoft.com/.default',
        'grant_type' => 'client_credentials'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($tokenData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    // IMPORTANTE: En producción es mejor usar CURLOPT_SSL_VERIFYPEER a true, 
    // pero a veces falla localmente si no hay certificados en el SO.
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 
    
    $tokenResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || $tokenResponse === false) {
        error_log("Error obteniendo token de Microsoft Graph: $httpCode - " . (string)$tokenResponse);
        return false;
    }

    $tokenJson = json_decode($tokenResponse, true);
    $accessToken = $tokenJson['access_token'] ?? '';

    if ($accessToken === '') {
        error_log('Error de correo: Token de acceso vacío.');
        return false;
    }

    // 3. Preparar el envío del correo
    $sendUrl = "https://graph.microsoft.com/v1.0/users/{$fromEmail}/sendMail";
    
    $messagePayload = [
        'message' => [
            'subject' => $subject,
            'body' => [
                'contentType' => 'HTML',
                'content' => $htmlBody
            ],
            'toRecipients' => [
                [
                    'emailAddress' => [
                        'address' => $toEmail
                    ]
                ]
            ]
        ],
        'saveToSentItems' => 'true'
    ];

    if ($replyTo !== null && $replyTo !== '') {
        $messagePayload['message']['replyTo'] = [
            [
                'emailAddress' => [
                    'address' => $replyTo
                ]
            ]
        ];
    }

    $chMail = curl_init();
    curl_setopt($chMail, CURLOPT_URL, $sendUrl);
    curl_setopt($chMail, CURLOPT_POST, true);
    curl_setopt($chMail, CURLOPT_POSTFIELDS, json_encode($messagePayload));
    curl_setopt($chMail, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chMail, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($chMail, CURLOPT_SSL_VERIFYPEER, false);

    $mailResponse = curl_exec($chMail);
    $mailHttpCode = curl_getinfo($chMail, CURLINFO_HTTP_CODE);
    curl_close($chMail);

    // Graph API retorna 202 Accepted para envíos exitosos
    if ($mailHttpCode !== 202) {
        error_log("Error enviando correo por Graph API: HTTP $mailHttpCode - " . (string)$mailResponse);
        return false;
    }

    return true;
}
