describe("Hello", function() {
  it("says hello to specified thing", function() {
    expect(sayHello('world')).toBe("Hello, world!");
  });
});