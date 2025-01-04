import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

if (!resendApiKey) {
    console.error('RESEND_API_KEY no está definida en las variables de entorno.');
}

const resend = new Resend(resendApiKey);

export const sendEmail = async (to: string, subject: string, html: string) => {
    console.log('Iniciando proceso de envío de email');
    console.log('RESEND_API_KEY definida:', !!resendApiKey);
    console.log('From Email:', fromEmail);
    console.log('To Email:', to);
    console.log('Subject:', subject);

    if (!resendApiKey) {
        console.error('No se puede enviar el email: RESEND_API_KEY no está definida');
        return { success: false, error: 'API key no configurada' };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('Error retornado por Resend:', error);
            return { success: false, error: JSON.stringify(error) };
        }

        console.log('Email enviado exitosamente:', data);
        return { success: true, data };
    } catch (error: any) {
        console.error('Error al enviar el email:', error);
        if (error.response) {
            console.error('Respuesta de error de Resend:', error.response.data);
        }
        return {
            success: false,
            error: error.message || 'Error desconocido al enviar el email',
            details: error.response ? error.response.data : undefined
        };
    }
};

