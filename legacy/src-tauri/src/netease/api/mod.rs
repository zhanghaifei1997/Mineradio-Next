//! NeteaseCloudMusicApi module implementations
//! Each module constructs parameters and delegates to `request::create_request`.

pub mod search;
pub mod song;
pub mod login;
pub mod playlist;
pub mod artist;
pub mod lyric;
pub mod comment;
pub mod personalized;
pub mod podcast;
pub mod like;
