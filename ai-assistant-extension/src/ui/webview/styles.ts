import { CSSProperties } from 'react';

export const webviewStyles: CSSProperties = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '10px',
        backgroundColor: '#f5f5f5',
    },
    header: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '10px',
    },
    messageList: {
        flex: 1,
        overflowY: 'auto',
        padding: '5px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        backgroundColor: '#fff',
    },
    message: {
        padding: '8px',
        borderRadius: '4px',
        marginBottom: '5px',
        backgroundColor: '#e1f5fe',
    },
    inputContainer: {
        display: 'flex',
        marginTop: '10px',
    },
    input: {
        flex: 1,
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        fontSize: '16px',
    },
    sendButton: {
        marginLeft: '10px',
        padding: '10px 15px',
        border: 'none',
        borderRadius: '5px',
        backgroundColor: '#007acc',
        color: '#fff',
        cursor: 'pointer',
    },
};