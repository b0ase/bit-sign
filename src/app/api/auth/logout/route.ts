import { NextResponse } from 'next/server';

export async function GET() {
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`);

    // Clear the cookies
    response.cookies.delete('handcash_auth_token');
    response.cookies.delete('handcash_handle');

    return response;
}
