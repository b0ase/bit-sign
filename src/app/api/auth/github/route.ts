import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'GitHub Client ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo') || '/user/account';

    // Scopes required for commit verification and profile linking
    const scopes = ['user:email', 'read:user'].join(' ');

    // Redirect to GitHub
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scopes}&state=${encodeURIComponent(returnTo)}`;

    return NextResponse.redirect(githubUrl);
}
