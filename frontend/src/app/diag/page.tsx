export default function DiagPage() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'NOT_SET';
    return (
        <pre style={{ padding: 40, fontSize: 18 }}>
            NEXT_PUBLIC_API_URL = &quot;{apiUrl}&quot;
        </pre>
    );
}
