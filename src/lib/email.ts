'use server';

import { Resend } from 'resend';
import { z } from 'zod';

function getResendInstance() {
    if (process.env.RESEND_API_KEY) {
        return new Resend(process.env.RESEND_API_KEY);
    }
    return null;
}


const sendEmailInput = z.object({
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
});

export async function sendEmail(input: z.infer<typeof sendEmailInput>) {
    const { to, subject, html } = sendEmailInput.parse(input);
    
    const resendInstance = getResendInstance();

    if (!resendInstance) {
        const warningMessage = 'RESEND_API_KEY no está configurada en .env. El correo electrónico no se enviará.';
        console.warn(warningMessage);
        // Simulate a successful response in dev to not block UI, but indicate it wasn't sent.
        return { message: warningMessage, id: null };
    }

    try {
        const { data, error } = await resendInstance.emails.send({
            from: 'AcademiCS <noreply@thaliavictoria.com.ec>', // Change to your verified domain
            to,
            subject,
            html,
        });

        if (error) {
            console.error('Error al enviar el correo con Resend:', error);
            throw new Error(`No se pudo enviar el correo: ${error.message}`);
        }

        console.log('Correo enviado exitosamente. ID:', data?.id);
        return { message: "Correo enviado exitosamente.", id: data?.id };
    } catch (error) {
        console.error('Error inesperado al enviar el correo:', error);
        if (error instanceof Error) {
            throw new Error(`Ocurrió un error inesperado al intentar enviar el correo: ${error.message}`);
        }
        throw new Error('Ocurrió un error inesperado al intentar enviar el correo.');
    }
}

interface EnrollmentNotificationParams {
    studentName: string;
    studentEmail: string;
    courseTitle: string;
    teacherName: string;
}

export async function sendEnrollmentNotification(params: EnrollmentNotificationParams) {
    const { studentName, studentEmail, courseTitle, teacherName } = params;

    const subject = `¡Estás inscrito en un nuevo curso: ${courseTitle}!`;

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h1 style="font-size: 24px; color: #005A9C;">¡Hola, ${studentName}!</h1>
                <p>¡Buenas noticias! Has sido inscrito en un nuevo curso en la plataforma AcademiCS.</p>
                <p>Tu profesor, <strong>${teacherName}</strong>, te ha añadido al siguiente curso:</p>
                <div style="background-color: #f2f2f2; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h2 style="font-size: 20px; margin-top: 0;">${courseTitle}</h2>
                </div>
                <p>Ya puedes acceder a la plataforma para empezar a aprender. ¡Esperamos que lo disfrutes!</p>
                <a href="#" style="display: inline-block; background-color: #007BFF; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                    Ir a Mis Cursos
                </a>
                <p style="margin-top: 30px; font-size: 12px; color: #777;">
                    Este es un correo automático. Por favor, no respondas a este mensaje.
                </p>
            </div>
        </div>
    `;

    return sendEmail({
        to: studentEmail,
        subject: subject,
        html: htmlBody,
    });
}
