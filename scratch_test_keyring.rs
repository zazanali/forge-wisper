use keyring::Entry;

#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        println!("Inside tokio spawn");
        let entry = Entry::new("ForgeWisper", "groq_api_key").unwrap();
        let _ = entry.get_password();
        println!("Keyring access completed");
    });
    let _ = handle.await;
}
