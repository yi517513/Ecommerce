const User = require("../models/userModel");
const Image = require("../models/imageModel");
const { s3, DeleteObjectCommand } = require("../config/s3");

const uploadProductImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("沒有上傳圖片");
    }

    const imageUrl = req.file.location;
    const imageKey = req.file.key;
    const userId = req.user.id;

    // 創建新的圖片記錄
    const newImage = new Image({ url: imageUrl, key: imageKey, userId });
    const savedImage = await newImage.save();

    // 更新用戶的 images 欄位，將新圖片的 ID 添加進去
    await User.findByIdAndUpdate(userId, {
      $push: { images: savedImage._id },
    });

    const { _id, url } = savedImage;
    return res.status(200).send({ message: "上傳成功", newData: { _id, url } });
  } catch (error) {
    console.log(error);
    return res.status(500).send("伺服器發生錯誤");
  }
};

const getProductImages = async (req, res) => {
  console.log("Inside getProductImages");
  try {
    const userId = req.user.id;
    // 從user中獲取products的ID陣列
    const foundUser = await User.findById(userId).exec();
    const imageIds = foundUser.images;

    // 使用 $in 運算符查找所有符合 ID 陣列的圖片，並只返回 _id 和 url
    const images = await Image.find({ _id: { $in: imageIds } })
      .select("_id url")
      .exec();

    console.log("success get images");
    return res.status(200).send({ data: images });
  } catch (error) {
    res.status(500).send("無法獲取圖片");
  }
};

const deleteProductImages = async (req, res) => {
  const { imageId } = req.params;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: "找不到使用者" });
    }

    const image = await Image.findByIdAndDelete(imageId);
    if (!image) {
      return res.status(404).send({ message: "圖片未找到" });
    }

    // 刪除 S3 上的圖片
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: image.key,
    });
    await s3.send(deleteCommand);

    // 從用戶的 images 陣列中刪除該圖片 ID
    await User.findByIdAndUpdate(userId, {
      $pull: { images: imageId },
    });

    // 刪除圖片記錄
    await Image.findByIdAndDelete(imageId);

    res.status(200).send({ message: "成功刪除圖片" });
  } catch (error) {
    console.error("伺服器發生錯誤:", error);
    res.status(500).send("伺服器發生錯誤");
  }
};

module.exports = {
  uploadProductImage,
  getProductImages,
  deleteProductImages,
};
