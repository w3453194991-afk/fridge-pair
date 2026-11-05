Page({
  onLoad() {
    wx.showToast({ title: 'Page removed', icon: 'none' });
    setTimeout(() => wx.navigateBack(), 600);
  }
});