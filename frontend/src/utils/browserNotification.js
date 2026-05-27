export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
};

export const sendBrowserNotification = async (title, body) => {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
        new Notification(title, {
            body: body,
            icon: '/logo.png', 
            requireInteraction: true 
        });
    }
};
